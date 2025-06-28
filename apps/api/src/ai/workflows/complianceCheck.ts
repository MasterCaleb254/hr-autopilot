// apps/api/src/ai/workflows/complianceCheck.ts
/**
 * Continuous compliance monitoring workflow
 * Detects labor law violations and policy breaches
 */

import { ComplianceAlert } from '../../../db/types';
import { BaseWorkflow } from './baseWorkflow';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';

export class ComplianceCheckWorkflow extends BaseWorkflow {
  private readonly detectionChain: RunnableSequence;

  constructor() {
    super('compliance-check');
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
    });

    this.detectionChain = RunnableSequence.from([
      {
        data: (input: string) => input,
      },
      {
        messages: (prev) => [
          new SystemMessage(`
            Analyze HR data for compliance issues. Check for:
            1. Working hour violations
            2. Contract discrepancies
            3. Leave policy breaches
            
            Respond with JSON: {
              issues: Array<{
                type: string,
                severity: "HIGH"|"MEDIUM"|"LOW",
                description: string,
                suggestedActions: string[]
              }>
            }`),
          new HumanMessage(prev.data),
        ],
      },
      model,
      new StringOutputParser(),
    ]);
  }

  /**
   * Scans HR data for compliance risks
   * @param data - Raw HR data snapshot
   * @returns Detected compliance issues
   */
  async scan(data: {
    workHours: Record<string, number>;
    contracts: Record<string, string>;
    leaveRecords: string[];
  }): Promise<ComplianceAlert[]> {
    const input = JSON.stringify(data, null, 2);
    const response = await this.detectionChain.invoke(input);
    
    try {
      const result = JSON.parse(response);
      return result.issues.map((issue: any) => ({
        ...issue,
        detectedAt: new Date().toISOString(),
        status: 'OPEN',
      }));
    } catch (e) {
      throw new Error(`Failed to parse compliance scan results: ${response}`);
    }
  }
}