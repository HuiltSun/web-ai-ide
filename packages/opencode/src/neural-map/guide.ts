import { generateText } from "ai"
import type { GraphNode } from "./types"

export interface GuideRequest {
  node: GraphNode
  allNodeIds: string[]
  understoodNodeIds: string[]
  userAnswer?: string
}

export interface GuideResponse {
  intro: string
  quiz: string
  feedback: string
  nextNodeId: string | null
}

function buildSystemPrompt(): string {
  return `You are an expert software architecture guide helping a developer understand a codebase.
Your role is to:
1. Briefly explain what a code module does (2-3 sentences max)
2. Ask a Socratic question to test understanding
3. If the user answered, give brief feedback (1-2 sentences)
4. Suggest the most logical next module to explore

Always respond with valid JSON matching this exact shape:
{
  "intro": "string",
  "quiz": "string",
  "feedback": "string (empty string if no user answer)",
  "nextNodeId": "string or null"
}`
}

function buildUserPrompt(req: GuideRequest): string {
  const { node, allNodeIds, understoodNodeIds, userAnswer } = req
  const remaining = allNodeIds.filter((id) => !understoodNodeIds.includes(id) && id !== node.id)

  return JSON.stringify({
    module: {
      id: node.id,
      label: node.label,
      fileCount: node.fileCount,
      lineCount: node.lineCount,
      activity: node.activity,
    },
    userAnswer: userAnswer ?? null,
    availableNextModules: remaining.slice(0, 5),
    alreadyUnderstood: understoodNodeIds,
  })
}

export async function generateGuide(model: any, req: GuideRequest): Promise<GuideResponse> {
  const { text } = await generateText({
    model,
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(req),
    temperature: 0.3,
    maxOutputTokens: 400,
  })

  try {
    const parsed = JSON.parse(text) as GuideResponse
    return {
      intro: parsed.intro ?? "",
      quiz: parsed.quiz ?? "",
      feedback: parsed.feedback ?? "",
      nextNodeId: parsed.nextNodeId ?? null,
    }
  } catch (err) {
    console.error("[guide] Failed to parse AI response as JSON:", err)
    return {
      intro: text.slice(0, 200),
      quiz: "你认为这个模块最重要的职责是什么？",
      feedback: "",
      nextNodeId: null,
    }
  }
}
