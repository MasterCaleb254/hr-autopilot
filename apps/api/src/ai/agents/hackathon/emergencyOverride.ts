// apps/api/src/ai/agents/hackathon/emergencyOverride.ts
/**
 * Emergency override handler for critical situations during demos.
 * Provides audit trails even when bypassing normal procedures.
 */

import { AuditService } from '../../services/audit';
import { HRManager } from '../../models/employees';
import { HRDecision } from '../../../db/types';

export class EmergencyOverrideAgent {
  private auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
  }

  /**
   * Forces approval of a leave request with mandatory justification
   * @param request - The leave request to override
   * @param manager - The authorized HR manager initiating override
   * @param justification - Reason for bypassing normal workflow
   */
  forceApprove(
    request: LeaveRequest,
    manager: HRManager,
    justification: string
  ): HRDecision {
    if (!this.isAuthorizedForOverride(manager)) {
      throw new Error('Manager not authorized for emergency overrides');
    }

    this.auditService.logOverride({
      requestId: request.id,
      managerId: manager.id,
      justification,
      timestamp: new Date()
    });

    return {
      status: 'APPROVED',
      reason: `Emergency override: ${justification}`,
      metadata: {
        overriddenBy: manager.name,
        normalPolicy: 'Bypassed for demo purposes'
      }
    };
  }

  /**
   * Validates manager's override authorization level
   */
  private isAuthorizedForOverride(manager: HRManager): boolean {
    return manager.clearanceLevel >= 3; // Level 3+ can override
  }
}