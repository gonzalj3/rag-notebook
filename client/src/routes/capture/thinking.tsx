import { createFileRoute } from '@tanstack/react-router'
import { ThinkingView } from '@/components/capture/ThinkingView'

export const Route = createFileRoute('/capture/thinking')({
  component: ThinkingView,
})
