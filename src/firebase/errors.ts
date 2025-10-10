
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public context: any;

  constructor(context: SecurityRuleContext) {
    const auth = getAuth(app);
    const user = auth.currentUser;

    const requestContext = {
      auth: user ? {
        uid: user.uid,
        token: {
          name: user.displayName,
          picture: user.photoURL,
          email: user.email,
          email_verified: user.email_verified,
          phone_number: user.phoneNumber,
          firebase: {
            identities: user.providerData.reduce((acc: any, p) => {
              const providerId = p.providerId;
              if (providerId) {
                acc[providerId] = [p.uid];
              }
              return acc;
            }, {}),
            sign_in_provider: user.providerData[0]?.providerId || 'custom',
          },
        },
      } : null,
      method: context.operation,
      path: `/databases/(default)/documents/${context.path}`,
      request: {
        resource: {
          data: context.requestResourceData,
        },
      },
      time: new Date().toISOString(),
    };

    const prettyJson = JSON.stringify(requestContext, null, 2);
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${prettyJson}`;
    
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = requestContext;

    // This is to make the error visible in the Next.js overlay in dev mode
    if (typeof (this as any).stack === 'string') {
        (this as any).stack = `${message}\n${(this as any).stack}`;
    }
  }
}
