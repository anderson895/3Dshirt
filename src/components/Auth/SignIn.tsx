import { useState } from 'react'
import { authService } from '../../services/authService'
import './SignIn.css'

interface SignInProps {
  onSuccess?: () => void
  onToggleMode?: () => void
  mode?: 'signin' | 'signup'
}

export default function SignIn({ onSuccess, onToggleMode, mode = 'signin' }: SignInProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await authService.signUp(email, password, fullName || undefined)
        if (error) {
          setError(error.message)
        } else {
          setSuccess('Account created! Please check your email to verify your account.')
          setTimeout(() => {
            onSuccess?.()
          }, 2000)
        }
      } else {
        const { error } = await authService.signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          setSuccess('Signed in successfully!')
          onSuccess?.()
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="signin-container">
      <div className="signin-card">
        <h2>{mode === 'signup' ? 'Create Account' : 'Sign In'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="fullName">Full Name (optional)</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <p className="toggle-mode">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={onToggleMode} className="link-button">
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={onToggleMode} className="link-button">
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

