import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { getProjects, getProject, getProjectSuggestions, addToProject, updateProject, createProject } from '@/lib/api'
import type { Project, Document, SourceType } from '@/lib/types'
import { Route } from '@/routes/retrieve/projects'
import styles from './ProjectsView.module.css'

/** Map of progress ranges to human labels */
function progressLabel(progress: number): string {
  if (progress <= 20) return 'collecting'
  if (progress <= 40) return 'drafting'
  if (progress <= 60) return 'building'
  if (progress <= 80) return 'refining'
  return 'polishing'
}

/** Count items by type */
function itemCountsByType(items: Document[]): { type: SourceType; label: string; count: number }[] {
  const counts = new Map<SourceType, number>()
  for (const item of items) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  }

  const labelMap: Record<SourceType, string> = {
    url: 'articles',
    note: 'notes',
    paste: 'pastes',
    handwritten: 'handwritten',
    conversation: 'conversations',
    dialogue: 'dialogues',
    book_page: 'book pages',
    takeaway: 'takeaways',
  }

  return Array.from(counts.entries()).map(([type, count]) => ({
    type,
    label: labelMap[type],
    count,
  }))
}

/** Group items by a section label */
function groupItems(items: Document[]): { label: string; items: Document[] }[] {
  const sectionMap: Record<string, { label: string; types: SourceType[] }> = {
    articles: { label: 'Articles', types: ['url'] },
    notes: { label: 'My Notes & Thinking', types: ['note', 'takeaway', 'handwritten', 'dialogue', 'paste'] },
    conversations: { label: 'Conversations', types: ['conversation'] },
    books: { label: 'Book Pages', types: ['book_page'] },
  }

  const groups: { label: string; items: Document[] }[] = []

  for (const section of Object.values(sectionMap)) {
    const matching = items.filter((d) => section.types.includes(d.type))
    if (matching.length > 0) {
      groups.push({ label: section.label, items: matching })
    }
  }

  return groups
}


// ─── Project Card ───────────────────────────────────────────

interface ProjectCardProps {
  project: Project
  onClick: () => void
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  const counts = useMemo(() => itemCountsByType(project.items), [project.items])

  return (
    <div className={styles.projectCard} onClick={onClick} role="button" tabIndex={0}>
      <div className={styles.projectCardTop}>
        <span className={styles.projectIcon}>{project.icon}</span>
        <div className={styles.projectInfo}>
          <div className={styles.projectName}>{project.name}</div>
          <div className={styles.projectDesc}>{project.description}</div>
        </div>
      </div>
      {project.tags.length > 0 && (
        <div className={styles.projectTags}>
          {project.tags.map((tag) => (
            <span key={tag} className={styles.projectTag}>{tag}</span>
          ))}
        </div>
      )}
      <div className={styles.projectStats}>
        <span className={styles.projectStat}>
          <strong>{project.items.length}</strong> items
        </span>
        {counts.map(({ type, label, count }) => (
          <span key={type} className={styles.projectStat}>
            <strong>{count}</strong> {label}
          </span>
        ))}
        <span className={styles.projectStat}>updated {project.createdAt}</span>
      </div>
      <div className={styles.projectProgress}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${project.progress}%` }} />
        </div>
        <span className={styles.progressLabel}>{progressLabel(project.progress)}</span>
      </div>
    </div>
  )
}

// ─── Project Detail ─────────────────────────────────────────

interface ProjectDetailProps {
  project: Project
  onBack: () => void
}

function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [notes, setNotes] = useState(project.notes)
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Document[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Fetch suggestions from server
  useEffect(() => {
    getProjectSuggestions(project.id).then(setSuggestions).catch(() => {})
  }, [project.id])

  const groups = useMemo(() => groupItems(project.items), [project.items])

  // Auto-resize textarea
  const handleNotesInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNotes(value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`

    // Debounced save to server
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateProject(project.id, { notes: value }).catch(() => {})
    }, 1000)
  }, [project.id])

  // Initial auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [])

  const handleAddSuggestion = useCallback((docId: string) => {
    setAddedSuggestions((prev) => new Set(prev).add(docId))
    addToProject(project.id, docId).catch(() => {})
  }, [project.id])

  return (
    <>
      <button className={styles.detailBack} onClick={onBack} type="button">
        &larr; all projects
      </button>

      <div className={styles.detailHeader}>
        <div className={styles.detailTitle}>{project.name}</div>
        <div className={styles.detailDesc}>{project.description}</div>
        <div className={styles.detailMeta}>
          <span className={styles.detailStat}>{project.items.length} items</span>
          <span className={styles.detailStat}>created {project.createdAt}</span>
          <span className={styles.detailStat}>status: {progressLabel(project.progress)}</span>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.label} className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>{group.label}</span>
            <span className={styles.sectionCount}>{group.items.length}</span>
          </div>
          {group.items.map((doc) => (
            <div key={doc.id} className={styles.item}>
              <span className={styles.itemType}>{doc.type.replace('_', ' ')}</span>
              <div className={styles.itemContent}>
                <div className={styles.itemTitle}>{doc.title}</div>
                <div className={styles.itemMeta}>
                  {doc.source && <>{doc.source} &middot; </>}
                  {doc.createdAt}
                  {doc.tags.length > 0 && <> &middot; {doc.tags.join(', ')}</>}
                </div>
                {doc.excerpt && (
                  <div className={styles.itemExcerpt}>{doc.excerpt}</div>
                )}
              </div>
              <button className={styles.itemRemove} title="Remove from project" type="button">
                &times;
              </button>
            </div>
          ))}
        </div>
      ))}

      {/* Project notes */}
      <div className={styles.projectNotes}>
        <div className={styles.notesLabel}>project notes &mdash; your outline &amp; draft ideas</div>
        <textarea
          ref={textareaRef}
          className={styles.notesTextarea}
          placeholder="blog angle, outline, key arguments..."
          value={notes}
          onChange={handleNotesInput}
        />
      </div>

      {/* Suggested from corpus */}
      {suggestions.length > 0 && (
        <div className={styles.suggested}>
          <div className={styles.suggestedLabel}>suggested from your corpus</div>
          {suggestions.map((doc) => (
            <div key={doc.id} className={styles.suggestedItem}>
              <span className={styles.suggestedTitle}>{doc.title || doc.excerpt}</span>
              <button
                className={`${styles.suggestedAdd} ${addedSuggestions.has(doc.id) ? styles.suggestedAddDone : ''}`}
                onClick={() => handleAddSuggestion(doc.id)}
                type="button"
              >
                {addedSuggestions.has(doc.id) ? 'added' : '+ add'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className={styles.detailActions}>
        <Link
          to="/retrieve/chat"
          search={{ projectId: project.id }}
          className={`${styles.detailAction} ${styles.detailActionPrimary}`}
        >
          discuss this project
        </Link>
        <Link
          to="/retrieve/compose"
          search={{ projectId: project.id }}
          className={`${styles.detailAction} ${styles.detailActionPrimary}`}
        >
          start composing
        </Link>
        <button className={styles.detailAction} type="button">
          find more items
        </button>
        <button className={styles.detailAction} type="button">
          export collection
        </button>
      </div>
    </>
  )
}

// ─── Main View ──────────────────────────────────────────────

export function ProjectsView() {
  const { projectId } = Route.useSearch()
  const navigate = useNavigate()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch project list
  useEffect(() => {
    setLoading(true)
    getProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Fetch detail when projectId changes
  useEffect(() => {
    if (!projectId) {
      setSelectedProject(null)
      return
    }
    getProject(projectId)
      .then((p) => setSelectedProject(p ?? null))
      .catch(() => setSelectedProject(null))
  }, [projectId])

  const handleSelectProject = useCallback(
    (id: string) => {
      navigate({
        to: '/retrieve/projects',
        search: { projectId: id },
        replace: true,
      })
    },
    [navigate],
  )

  const handleBack = useCallback(() => {
    navigate({
      to: '/retrieve/projects',
      search: {},
      replace: true,
    })
  }, [navigate])

  const handleNewProject = useCallback(async () => {
    const name = prompt('Project name:')
    if (!name?.trim()) return
    try {
      const project = await createProject(name.trim(), '')
      setProjects((prev) => [project, ...prev])
      handleSelectProject(project.id)
    } catch { /* ignore */ }
  }, [handleSelectProject])

  return (
    <PageContainer mode="projects" maxWidth={700}>
      <ModeHeader category="retrieve" mode="projects">
        <button className={styles.newProjectBtn} type="button" onClick={handleNewProject}>
          + new project
        </button>
      </ModeHeader>

      {selectedProject ? (
        <ProjectDetail project={selectedProject} onBack={handleBack} />
      ) : loading ? (
        <div className={styles.projectGrid}>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
            loading projects...
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
          no projects yet — create one to start collecting
        </div>
      ) : (
        <div className={styles.projectGrid}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleSelectProject(project.id)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
