import { useAuthStore } from '@/store/auth';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';

class EmailService {
  static async sendConfirmationEmail(email, password) {
    try {
      const authStore = useAuthStore();
      if (!authStore.isFirekitInit) {
        throw new Error('Firebase not initialized');
      }

      // Send email verification
      const actionCodeSettings = {
        url: `${window.location.origin}/signin`,
        handleCodeInApp: true,
      };

      // Wait for roarfirekit to be fully initialized
      if (!authStore.roarfirekit?.app?.auth) {
        throw new Error('Firebase App auth is not initialized');
      }

      // Get the app auth instance and sign in
      const userCredential = await signInWithEmailAndPassword(authStore.roarfirekit.app.auth, email, password);

      // Send verification email to the newly signed in user
      await sendEmailVerification(userCredential.user, actionCodeSettings);

      // Note: The actual email content will be handled by Firebase's email templates
      // You can customize these templates in the Firebase Console under Authentication > Templates

      return {
        success: true,
        message: 'Confirmation email sent successfully',
      };
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      throw new Error('Failed to send confirmation email');
    }
  }
}

export default EmailService;
