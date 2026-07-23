export const environment = {
  production: true,
  // Live custom domain -- API Gateway base-path mapping
  // api.xomtracks.xomware.com verified against the deployed REST API.
  apiBaseUrl: 'https://api.xomtracks.xomware.com',
  awsRegion: 'us-east-1',
  // Cognito pool/client id are public-by-design (frontend bundles ship
  // them) but injected at deploy time from SSM rather than hardcoded --
  // mirrors xomforms-frontend's deploy-frontend.yml, so a pool/client
  // change never requires an application-code change.
  cognitoUserPoolId: '',
  cognitoClientId: '',
  cognitoDomain: 'xomware-auth.auth.us-east-1.amazoncognito.com',
};
