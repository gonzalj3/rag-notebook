import { createFileRoute } from '@tanstack/react-router'
import { CurationView } from '@/components/capture/CurationView'

export const Route = createFileRoute('/capture/curation')({
  component: CurationView,
})
