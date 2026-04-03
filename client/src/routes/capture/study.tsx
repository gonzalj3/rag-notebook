import { createFileRoute } from '@tanstack/react-router'
import { StudyView } from '@/components/capture/StudyView'

export const Route = createFileRoute('/capture/study')({
  component: StudyView,
})
