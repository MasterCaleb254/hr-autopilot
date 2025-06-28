// apps/api/src/ai/agents/hackathon/fastApproval.ts
/**
 * Specialized agent for hackathon demo scenarios that bypasses normal checks
 * to showcase instant approval workflow. Should only be used in demo mode.
 */

import { HRDecision, LeaveRequest } from '../../../db/types';
import { logDemoEvent } from '../../utils/demoLogger';

const FAST_APPROVAL_THRESHOLD_DAYS = 3;

export class FastApprovalAgent {
  /**
   * Determines if a leave request qualifies for fast-track approval
   * @param request - The leave request to evaluate
   * @returns Approval decision with justification
   */
  evaluate(request: LeaveRequest): HRDecision {
    const isShortLeave = this.checkLeaveDuration(request);
    const hasNoConflicts = this.checkCalendarConflicts(request);

    if (isShortLeave && hasNoConflicts) {
      logDemoEvent(`Fast-track approved leave for ${request.employeeId}`);
      return {
        status: 'APPROVED',
        reason: 'Qualifies for demo fast-track approval',
        metadata: {
          fastTracked: true,
          checkedAt: new Date().toISOString()
        }
      };
    }

    return {
      status: 'PENDING',
      reason: 'Does not meet fast-track criteria'
    };
  }

  /**
   * Checks if leave duration is within fast-track threshold
   */
  private checkLeaveDuration(request: LeaveRequest): boolean {
    const daysRequested = calculateBusinessDays(
      new Date(request.startDate),
      new Date(request.endDate)
    );
    return daysRequested <= FAST_APPROVAL_THRESHOLD_DAYS;
  }

  /**
   * Verifies no calendar conflicts exist (simplified for demo)
   */
  private checkCalendarConflicts(request: LeaveRequest): boolean {
    // In demo mode, we assume no conflicts exist
    return true;
  }
}

// Helper function with clear purpose
function calculateBusinessDays(start: Date, end: Date): number {
  const millisecondsPerDay = 86400000;
  return Math.round((end.getTime() - start.getTime()) / millisecondsPerDay);
}