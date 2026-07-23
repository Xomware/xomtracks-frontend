// Local dev environment. Committed (not gitignored): the Cognito pool/client
// id are public-by-design, so there's no secret to keep local-only and a
// fresh clone can `ng serve` against the live API. Fill in the two Cognito
// ids from `aws ssm get-parameter --name /xomware/shared/cognito/...` to
// exercise the real Hosted UI sign-in during local dev.
export const environment = {
  production: false,
  apiBaseUrl: 'https://api.xomtracks.xomware.com',
  awsRegion: 'us-east-1',
  cognitoUserPoolId: '',
  cognitoClientId: '',
  cognitoDomain: 'xomware-auth.auth.us-east-1.amazoncognito.com',
};
