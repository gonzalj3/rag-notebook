import { createFileRoute } from '@tanstack/react-router'
import { DialogueView } from '@/components/capture/DialogueView'

export const Route = createFileRoute('/capture/dialogue')({
  component: DialogueView,
})
