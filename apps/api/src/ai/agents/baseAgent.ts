// apps/api/src/ai/agents/baseAgent.ts
/**
 * Abstract base class for all HR Autopilot agents
 * Provides common functionality and enforces consistent interfaces
 */

import { HRDecision, LeaveRequest, Employee } from '../../../db/types';
import { AuditLogger } from '../../services/audit';

export abstract class BaseAgent {
  protected auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Main evaluation method all agents must implement
   * @param request - Leave request to evaluate
   * @param employee - Employee making the request
   * @returns Decision with justification
   */
  abstract evaluate(
    request: LeaveRequest,
    employee: Employee
  ): Promise<HRDecision>;

  /**
   * Common validation for all leave requests
   * @param request - Leave request to validate
   * @throws Error if request is invalid
   */
  protected validateRequest(request: LeaveRequest): void {
    if (!request.startDate || !request.endDate) {
      throw new Error('Missing required dates in leave request');
    }

    if (new Date(request.startDate) > new Date(request.endDate)) {
      throw new Error('Start date cannot be after end date');
    }
  }

  /**
   * Standardized approval logging
   * @param decision - The decision being logged
   * @param context - Additional context information
   */
  protected logDecision(
    decision: HRDecision,
    context: { requestId: string; agentType: string }
  ): void {
    this.auditLogger.log({
      event: 'LEAVE_DECISION',
      entityId: context.requestId,
      metadata: {
        agent: context.agentType,
        status: decision.status,
        reason: decision.reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Calculates business days between two dates
   * (Excluding weekends)
   */
  protected calculateBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Standard error handler for all agents
   */
  protected handleError(error: unknown, context: string): HRDecision {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';

    this.auditLogger.log({
      event: 'AGENT_ERROR',
      entityId: context,
      metadata: {
        error: errorMessage,
        timestamp: new Date().toISOString()
      }
    });

    return {
      status: 'ERROR',
      reason: `Failed to process request: ${errorMessage}`
    };
  }
}