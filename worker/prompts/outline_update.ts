export function renderOutlineUpdatePrompt(designId: string) {
  const placeholder = '<design id>';
  const base = `Here are the responses to the questions for Design ID: ${placeholder}, please consider them and update the outline accordingly.\n\nReturn your result strictly as JSON with two keys: { \"outline\": \"<markdown outline>\", \"questions\": [\"question 1\", \"question 2\"] }\nDo not include any additional keys or text outside JSON.`;
  return base.replace(placeholder, designId);
}

export const OUTLINE_UPDATE_PROMPT_NAME = 'outline_update';
