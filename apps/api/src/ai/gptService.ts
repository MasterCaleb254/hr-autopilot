// apps/api/src/ai/gptService.ts
/**
 * Centralized service for OpenAI GPT interactions
 * Handles model selection, rate limiting, and response standardization
 */

import { ChatOpenAI, OpenAI } from '@langchain/openai';
import { BaseCache } from '@langchain/core/caches';
import { HRDecision, ComplianceAlert, OnboardingPlan } from '../../../db/types';
import { AuditLogger } from '../../services/audit';
import { CostTracker } from '../../utils/costTracker';

interface GPTResponse<T> {
  data: T;
  metadata: {
    model: string;
    tokensUsed: number;
    processingTimeMs: number;
  };
}

export class GPTService {
  private readonly auditLogger: AuditLogger;
  private readonly costTracker: CostTracker;
  private cache?: BaseCache;
  private currentModel: 'gpt-3.5-turbo' | 'gpt-4-turbo' = 'gpt-3.5-turbo';

  constructor(options: {
    auditLogger: AuditLogger;
    costTracker: CostTracker;
    cache?: BaseCache;
  }) {
    this.auditLogger = options.auditLogger;
    this.costTracker = options.costTracker;
    this.cache = options.cache;
  }

  /**
   * Evaluates a leave request using AI decision-making
   * @param request - Leave request details
   * @param context - Organizational context
   * @returns Standardized HR decision
   */
  async evaluateLeaveRequest(
    request: LeaveRequest,
    context: {
      employeeLeaveBalance: number;
      teamCoverage: number;
      projectDeadlines: string[];
    }
  ): Promise<GPTResponse<HRDecision>> {
    const startTime = Date.now();
    const model = this.createModelInstance();

    try {
      const messages = [
        this.createSystemMessage(`
          Analyze this leave request considering:
          1. Employee has ${context.employeeLeaveBalance} days remaining
          2. Team coverage during period: ${context.teamCoverage}%
          3. Project deadlines: ${
            context.projectDeadlines.length > 0
              ? context.projectDeadlines.join(', ')
              : 'None'
          }
          
          Respond with JSON: {
            decision: "APPROVED"|"DENIED"|"FLAGGED",
            reason: string,
            confidence: number
          }`),
        this.createHumanMessage(`
          Leave Request:
          - Dates: ${request.startDate} to ${request.endDate}
          - Reason: ${request.reason || 'Not specified'}`),
      ];

      const response = await model.invoke(messages);
      const result = this.parseDecisionResponse(response);

      return this.createResponse(result, startTime);
    } catch (error) {
      this.handleError(error, 'leave-request-evaluation');
      throw error;
    }
  }

  /**
   * Scans HR data for compliance violations
   * @param data - HR data snapshot
   * @returns Detected compliance issues
   */
  async scanForComplianceIssues(
    data: {
      workHours: Record<string, number>;
      contracts: Record<string, string>;
    }
  ): Promise<GPTResponse<ComplianceAlert[]>> {
    const startTime = Date.now();
    const model = this.createModelInstance();

    try {
      const response = await model.invoke([
        this.createSystemMessage(`
          Identify compliance issues in this HR data.
          Check for:
          1. Working hour violations (>40h/week)
          2. Missing contract elements
          3. Policy violations
          
          Respond with JSON: {
            issues: Array<{
              type: string,
              severity: "HIGH"|"MEDIUM"|"LOW",
              description: string
            }>
          }`),
        this.createHumanMessage(JSON.stringify(data, null, 2)),
      ]);

      const result = this.parseComplianceResponse(response);
      return this.createResponse(result, startTime);
    } catch (error) {
      this.handleError(error, 'compliance-scan');
      throw error;
    }
  }

  /**
   * Upgrades the model to GPT-4-turbo if available
   */
  upgradeToGPT4(): void {
    if (process.env.ENABLE_GPT4 === 'true') {
      this.currentModel = 'gpt-4-turbo';
      this.auditLogger.log({
        event: 'MODEL_UPGRADE',
        metadata: { newModel: 'gpt-4-turbo' },
      });
    }
  }

  // Private helper methods
  private createModelInstance(): ChatOpenAI {
    return new ChatOpenAI({
      modelName: this.currentModel,
      temperature: 0.2,
      maxTokens: 1000,
      cache: this.cache,
      configuration: {
        organization: process.env.OPENAI_ORG_ID,
      },
    });
  }

  private createSystemMessage(content: string): SystemMessage {
    return new SystemMessage(content);
  }

  private createHumanMessage(content: string): HumanMessage {
    return new HumanMessage(content);
  }

  private parseDecisionResponse(response: any): HRDecision {
    try {
      const content = typeof response.content === 'string' 
        ? JSON.parse(response.content) 
        : response.content;

      return {
        status: content.decision,
        reason: content.reason,
        metadata: {
          confidence: content.confidence,
          model: this.currentModel,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${response.content}`);
    }
  }

  private parseComplianceResponse(response: any): ComplianceAlert[] {
    try {
      const content = typeof response.content === 'string'
        ? JSON.parse(response.content)
        : response.content;

      return content.issues.map((issue: any) => ({
        type: issue.type,
        severity: issue.severity,
        description: issue.description,
        detectedAt: new Date().toISOString(),
      }));
    } catch (error) {
      throw new Error(`Failed to parse compliance response: ${response.content}`);
    }
  }

  private createResponse<T>(data: T, startTime: number): GPTResponse<T> {
    const processingTimeMs = Date.now() - startTime;
    const estimatedTokens = Math.ceil(JSON.stringify(data).length / 4);

    this.costTracker.trackUsage({
      model: this.currentModel,
      tokens: estimatedTokens,
      operation: this.getCallerName(),
    });

    return {
      data,
      metadata: {
        model: this.currentModel,
        tokensUsed: estimatedTokens,
        processingTimeMs,
      },
    };
  }

  private handleError(error: unknown, context: string): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    this.auditLogger.log({
      event: 'GPT_ERROR',
      context,
      error: errorMessage,
      model: this.currentModel,
    });

    throw new Error(`[GPTService] ${errorMessage}`);
  }

  private getCallerName(): string {
    return new Error().stack?.split('\n')[2].trim() || 'unknown';
  }
}