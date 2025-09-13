export function renderCheckerInitialPrompt(consultantMessage: string) {
  const placeholder = "<consultant message>";
  const base = `I would like your view on whether this text ${placeholder} is a suitable basis for building an agent based application.  please consider if it could be achieved best through procedural coding, simple automation or if an agentic approach with flexible and dynamic decision making and routing would be appropriate.  Please respond with a simple yes or no and also add a sentence summarizing your reasoning.  You do not need to design the agent solution, that will be dealt with subsequently if it is deemed to be a good idea.`;
  return base.replace(placeholder, consultantMessage);
}

export const CHECKER_PROMPT_NAME = "checker_initial_check";

