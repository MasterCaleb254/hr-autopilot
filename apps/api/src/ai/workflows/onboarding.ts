// apps/api/src/ai/workflows/onboarding.ts
/**
 * Automated onboarding workflow generator
 * Creates personalized onboarding plans
 */

import { OnboardingPlan, Employee } from '../../../db/types';
import { BaseWorkflow } from './baseWorkflow';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';

export class OnboardingWorkflow extends BaseWorkflow {
  private readonly planGenerator: PromptTemplate;
  private readonly model: ChatOpenAI;

  constructor() {
    super('onboarding');
    this.model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.3,
    });

    this.planGenerator = new PromptTemplate({
      template: `
      Create a {duration}-day onboarding plan for:
      - Role: {role}
      - Department: {department}
      - Experience Level: {experience}
      
      Include:
      1. Training sessions
      2. Required documentation
      3. Key introductions
      
      Respond with JSON format: {
        plan: Array<{
          day: number,
          activities: string[],
          goals: string[]
        }>
      }`,
      inputVariables: ['role', 'department', 'experience', 'duration'],
    });
  }

  /**
   * Generates personalized onboarding plan
   * @param employee - New employee details
   * @param duration - Onboarding duration in days
   * @returns Structured onboarding plan
   */
  async generatePlan(
    employee: Employee,
    duration: number = 30
  ): Promise<OnboardingPlan> {
    const input = await this.planGenerator.format({
      role: employee.position,
      department: employee.department,
      experience: employee.experienceLevel || 'Mid-level',
      duration: duration.toString(),
    });

    const response = await this.model.invoke(input);
    const content = response.content.toString();

    try {
      const result = JSON.parse(content);
      return {
        employeeId: employee.id,
        durationDays: duration,
        activities: result.plan,
        generatedAt: new Date().toISOString(),
      };
    } catch (e) {
      throw new Error(`Failed to parse onboarding plan: ${content}`);
    }
  }
}