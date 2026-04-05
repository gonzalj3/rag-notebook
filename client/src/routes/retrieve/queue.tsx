import { createFileRoute } from '@tanstack/react-router'
import { ReadingQueueView } from '@/components/retrieve/ReadingQueueView'

export const Route = createFileRoute('/retrieve/queue')({
  component: ReadingQueueView,
})
