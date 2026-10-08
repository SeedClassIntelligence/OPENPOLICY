export const landingCopy = {
  hero: {
    kicker: 'Open Policy · Policy review platform · Nevada personal auto',
    title: 'Share the policy you have. See what insurance providers offer.',
    body: 'Upload your current declarations page. Insurance providers can review it and send you offers. You compare them side by side and decide. Nothing changes unless you say so.',
  },
  comparison: {
    title: 'See how offers are shown',
    body: 'An example with made-up numbers. Real offers come from licensed providers. Open Policy does not set or change them.',
    note: 'Open Policy shows differences. It does not tell you which offer to choose.',
  },
  signup: {
    title: 'Create your account',
    body: 'Policyholders share a policy and review offers. Insurance providers apply for access to review shared policies and send offers. Currently available in Nevada for personal auto.',
  },
  commitments: [
    ['You stay in control.', 'You choose what policy information to share and whether to select an offer. Doing nothing keeps your current policy.'],
    ['Your contact details stay private.', 'They are shared only with the provider you choose, after you approve.'],
    ['Every difference is shown.', 'If an offer changes your coverage, you see exactly what changed. Details an offer does not state are shown as missing, not assumed.'],
    ['No paid placement.', 'Provider fees do not change how offers are shown to you.'],
    ['Same rules for every provider.', 'Large or small, every provider follows the same rules for reviewing policies and submitting offers.'],
    ['A record of key actions.', 'Key actions are logged in a tamper-evident record.'],
  ] as const,
  faqs: [
    ['Who can see my information?', 'Providers reviewing a shared policy see coverage details such as limits, deductibles, vehicle information and current premium. They do not see your name, phone number, email or address. If you choose a provider, you approve sharing contact details with that provider.'],
    ['Will providers contact me?', 'Not while they are reviewing your policy. If you choose a provider, that provider receives your contact details with your approval and can contact you to complete the application.'],
    ['Does sharing my policy commit me to anything?', 'No. You can keep your current policy at any time. There is no charge to you.'],
    ['How do I know whether an offer matches my current coverage?', 'Open Policy compares each offer with your declarations page and lists differences in limits, deductibles, add-ons and price. Offers that change coverage are marked. If an offer leaves a detail out, it is shown as missing. Open Policy does not tell you which offer to choose.'],
    ['What does Open Policy compare?', 'Open Policy compares each provider offer with the current policy you shared. It shows stated premium and coverage differences without setting target terms, minimum price differences or making the choice for you.'],
    ['Who are the providers?', 'Insurance agents, agencies and carriers that apply for access. Provider access remains pending until the required identity, organization and authority checks are completed.'],
    ['What does it cost?', 'There is no charge to policyholders. Provider terms and fees are stated in the provider agreement and do not change how offers are displayed.'],
    ['What can I use Open Policy for?', 'The current public offering is personal auto insurance in Nevada.'],
  ] as const,
};
