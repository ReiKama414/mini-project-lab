import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { randomInt } from '../../lib/utils'

const meta = getProject('github-contrib')!

function buildYear(seed: number) {
  const days = 52 * 7
  const data: number[] = []
  let s = seed
  for (let i = 0; i < days; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const v = s % 100
    data.push(v > 70 ? randomInt(1, 4) : v > 55 ? 1 : 0)
  }
  return data
}

export default function Page() {
  const [user, setUser] = useLocalStorage('lab:github-contrib:user', 'kamay')
  const data = useMemo(() => buildYear(user.split('').reduce((a, c) => a + c.charCodeAt(0), 0)), [user])
  const total = data.reduce((a, b) => a + b, 0)
  const colors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" value={user} onChange={(e) => setUser(e.target.value)} placeholder="GitHub username" />
          <span className="metric">{total} contributions (mock)</span>
        </div>
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 8 }}>
          {Array.from({ length: 52 }, (_, week) => (
            <div key={week} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Array.from({ length: 7 }, (_, day) => {
                const v = data[week * 7 + day] || 0
                return <div key={day} title={`${v}`} style={{ width: 11, height: 11, borderRadius: 2, background: colors[v] }} />
              })}
            </div>
          ))}
        </div>
        <div className="row muted" style={{ fontSize: 12 }}>
          Less
          {colors.map((c) => (
            <span key={c} style={{ width: 11, height: 11, background: c, borderRadius: 2, display: 'inline-block' }} />
          ))}
          More
        </div>
      </div>
    </ProjectShell>
  )
}
