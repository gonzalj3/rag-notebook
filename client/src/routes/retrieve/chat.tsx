import { createFileRoute } from '@tanstack/react-router'
import { ChatView } from '@/components/retrieve/ChatView'

type ChatSearch = {
  documentId?: string
  projectId?: string
}

export const Route = createFileRoute('/retrieve/chat')({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    documentId: search.documentId as string | undefined,
    projectId: search.projectId as string | undefined,
  }),
  component: ChatView,
})
