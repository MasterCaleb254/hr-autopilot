// apps/api/src/ai/workflows/leaveApproval.ts
/**
 * LangChain workflow for automated leave approval decisions
 * Considers: leave balance, team coverage, and project deadlines
 */

import { HRDecision, LeaveRequest, Employee } from '../../../db/types';
import { BaseWorkflow } from './baseWorkflow';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export class LeaveApprovalWorkflow extends BaseWorkflow {
  private readonly model: ChatOpenAI;

  constructor() {
    super('leave-approval');
    this.model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2,
      maxTokens: 500,
    });
  }

  /**
   * Evaluates a leave request using AI-assisted decision making
   * @param request - Leave request details
   * @param employee - Employee making the request
   * @param context - Additional organizational context
   * @returns Decision with justification
   */
  async evaluate(
    request: LeaveRequest,
    employee: Employee,
    context: {
      teamCoverage: number;
      criticalProjects: string[];
    }
  ): Promise<HRDecision> {
    try {
      this.validateInputs(request, employee);

      const messages = [
        new SystemMessage(`
          You are an HR autopilot specializing in leave approvals.
          Consider these factors:
          1. Employee's remaining leave balance
          2. Team coverage during leave period
          3. Impact on critical projects
          
          Respond with JSON only: {
            status: "APPROVED"|"DENIED"|"FLAGGED",
            reason: string,
            confidence: number
          }`),
        new HumanMessage(`
          Leave Request:
          - Employee: ${employee.name} (${employee.leaveBalance} days remaining)
          - Dates: ${request.startDate} to ${request.endDate}
          - Reason: ${request.reason || 'Not specified'}
          
          Context:
          - Team coverage during period: ${context.teamCoverage}%
          - Critical projects affected: ${
            context.criticalProjects.length > 0
              ? context.criticalProjects.join(', ')
              : 'None'
          }`),
      ];

      const response = await this.model.invoke(messages);
      return this.parseResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  private parseResponse(response: any): HRDecision {
    const content = response.content;
    try {
      const result = JSON.parse(content);
      return {
        status: result.status,
        reason: result.reason,
        metadata: {
          confidence: result.confidence,
          evaluatedAt: new Date().toISOString(),
        },
      };
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${content}`);
    }
  }
}