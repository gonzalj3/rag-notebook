import { createFileRoute } from '@tanstack/react-router'
import { ProjectsView } from '@/components/retrieve/ProjectsView'

type ProjectsSearch = {
  documentId?: string
  projectId?: string
}

export const Route = createFileRoute('/retrieve/projects')({
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    documentId: search.documentId as string | undefined,
    projectId: search.projectId as string | undefined,
  }),
  component: ProjectsView,
})
