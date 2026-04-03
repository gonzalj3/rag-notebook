import { createFileRoute } from '@tanstack/react-router'
import { BrowsingView } from '@/components/capture/BrowsingView'

export const Route = createFileRoute('/capture/browsing')({
  component: BrowsingView,
})
