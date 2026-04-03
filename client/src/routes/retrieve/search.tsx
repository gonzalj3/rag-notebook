import { createFileRoute } from '@tanstack/react-router'
import { SearchView } from '@/components/retrieve/SearchView'

export const Route = createFileRoute('/retrieve/search')({
  component: SearchView,
})
