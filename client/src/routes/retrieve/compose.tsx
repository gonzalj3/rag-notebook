import { createFileRoute } from '@tanstack/react-router'
import { ComposeView } from '@/components/retrieve/ComposeView'

type ComposeSearch = {
  projectId?: string
}

export const Route = createFileRoute('/retrieve/compose')({
  validateSearch: (search: Record<string, unknown>): ComposeSearch => ({
    projectId: search.projectId as string | undefined,
  }),
  component: ComposeView,
})
