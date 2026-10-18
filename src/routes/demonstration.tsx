import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/demonstration')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/demonstration"!</div>
}
