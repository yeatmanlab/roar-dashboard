/**
 * Options for embedding agreement versions.
 */
export const AgreementEmbedOption = {
  VERSIONS: 'versions',
} as const;

export type AgreementEmbedOptionType = (typeof AgreementEmbedOption)[keyof typeof AgreementEmbedOption];
