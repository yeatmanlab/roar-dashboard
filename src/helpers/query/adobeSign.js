// TODO CALL FROM FIREKIT
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://api.na4.adobesign.com:443/api/rest/v6',
  headers: {
    Authorization: ``,
    'Content-Type': 'application/json',
  },
});

export async function createAgreement(email, isConsent) {
  const postResponse = await axiosInstance.post('/agreements', {
    fileInfos: [
      {
        transientDocumentId: !isConsent
          ? `CBSCTBABDUAAABACAABAAgyRzxVBI93k0Ec8OqwOskYanjwdW9mcfVwKS1iL5TL2uf_FIOG3gdXBldLDstIwBqdsekG5JDX4laOKd6hzkXWhOwaqvyCurbWXHzCeB1VlsZ64a6yg2glUiruUFIU3V9bOwEIkmVMTQ9UTAq9LF_wwpekuSuOBLRfjooesKaeumjw6eCeJm9N7njruuLB9J-rlQMuMOZCcEOfinWn-rfFWy8tRClT6osElVkTqJvIcnftHdSUfu8MQfQKKUm7eCBq6Yt6qG3tzZxhwb5wJWQj8N8kNVkoxH6H3s8aIgrjoQbfGxIllkVoEPNz0Awj7PQH3rHu8D1Tv9q5l7nV7-fonNnHXYTsA8OogWHk8E4BxNt5mLr2yN7xeK-GHYewxy`
          : `CBSCTBABDUAAABACAABAAzAGjsRjJDssJwkwpVQoRHsh6T82MkYJVIOGC7gNvqJV7JAPPTMZvO7F1wLnnW2z_eYaeLQHvBRrggAbAcvDgX23GWaJAOcc0ZyOWmRwRD0Dg_s9ofApYU3-H9VHGpvoIlCawhNwjYyJbLkRRvvI6oTg5b7bDSzDtD67voHzD753VeZ1Oxol7Gqf_P5ESBQOiNc7tmQKGMsGkWYBJ0lYzYuFkKSG2G6VOUkwN9eLC9-M8iKingobZBkNO4efgjmypB-NAOdkiud0xXkBspW-akXwwry34h1mIkfkU-uzNAurew2OxdsFh-To0TmiOOun3MCid80-kz0B6jUgvxiPz0U4eNvh-bmswXdhgWw-YteRVHyWHeW96BXrQgWPj5vHy`,
      },
    ],
    name: 'ROAR - Consent',
    participantSetsInfo: [
      {
        order: 1,
        role: 'SIGNER',
        memberInfos: [
          {
            deliverableEmail: true,
            email: email,
          },
        ],
      },
    ],
    signatureType: 'ESIGN',
    state: 'IN_PROCESS',
  });
  console.log('agreement id ', postResponse.data.id);
  return await checkStatusUntilSigned(postResponse.data.id);
}

async function checkStatusUntilSigned(agreementId) {
  const documentStatusEndpoint = `https://api.na4.adobesign.com:443/api/rest/v6/agreements/${agreementId}`;

  const maxAttempts = 20;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(documentStatusEndpoint, {
      method: 'GET',
      headers: {
        Authorization: ``,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.status === 'SIGNED') {
      return 'SIGNED';
    }
    console.log('status ', data.status);

    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before the next check
    attempts++;
  }

  if (attempts === maxAttempts) {
    return 'NOT SIGNED';
  }
}
