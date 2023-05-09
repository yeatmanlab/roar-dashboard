const CLIENT_ID = '1ea25fd3a3b20f486151'
// const REDIRECT_URI = 'https://roar-platform.web.app/auth-from-clever'
const REDIRECT_URI = 'https://localhost:5173/auth-clever'

export function cleverSSOUrl() {
  return `https://clever.com/oauth/authorize?response_type=code&redirect_uri=${REDIRECT_URI}&client_id=${CLIENT_ID}`
}