import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SignIn from '../components/Auth/SignIn'

export default function SignInPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const navigate = useNavigate()

  const handleSuccess = () => {
    // Navigate to customize page after successful login/signup
    navigate('/customize')
  }

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
  }

  return (
    <SignIn 
      mode={mode}
      onSuccess={handleSuccess}
      onToggleMode={toggleMode}
    />
  )
}

