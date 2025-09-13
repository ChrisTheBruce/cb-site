export function renderOutlinePrompt(consultantMessage: string, checkerInitialResponse: string) {
  const p1 = '<consultant_message>';
  const p2 = '<checker_initial_response>';
  const base = `As an expert agent solution architect, please think carefully and generate an outline approach for an agentic solution described here: ${p1} which was validated by a checker agent with this comment: ${p2}.  Your solution should include an introductory paragraph explaining the approach, with a description of each agent required and a description of the typical flow and handoff between the agents.  You do not need to generate any code, this is just a high level outline that will be used to drive a subsequent development effort once it is approved to go ahead`;
  return base
    .replace(p1, consultantMessage)
    .replace(p2, checkerInitialResponse);
}

export const OUTLINE_PROMPT_NAME = 'outline_generation';

