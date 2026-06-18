import { generateText } from "ai"
import type { GraphNode } from "./types"

export interface GuideRequest {
  node: GraphNode
}

export interface GuideResponse {
  intro: string
}

function buildSystemPrompt(): string {
  return `You are a concise software architecture guide. When given a code module's metadata, explain in 2-3 sentences what it does and why it matters. Write in Chinese (中文). Output plain text only — no JSON, no markdown, no bullet points.`
}

function buildUserPrompt(req: GuideRequest): string {
  const { node } = req
  return `Module: ${node.label} (${node.id})\nFiles: ${node.fileCount}, Lines: ${node.lineCount}, Activity: ${node.activity}/100`
}

export async function generateGuide(model: any, req: GuideRequest): Promise<GuideResponse> {
  try {
    const result = await generateText({
      model,
      system: buildSystemPrompt(),
      prompt: buildUserPrompt(req),
      temperature: 0.4,
      maxOutputTokens: 200,
    })
    return { intro: result.text.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[guide] generateText failed:", msg)
    throw new Error(`AI generation failed: ${msg}`)
  }
}
