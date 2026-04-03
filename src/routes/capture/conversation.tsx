import { createFileRoute } from '@tanstack/react-router'
import { ConversationView } from '@/components/capture/ConversationView'

export const Route = createFileRoute('/capture/conversation')({
  component: ConversationView,
})
