import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Navigation } from '@/components/ui/Navigation'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <ThemeToggle />
      <Navigation />
      <Outlet />
    </>
  )
}
