import { defineField, defineType } from 'sanity';

export const tribute = defineType({
  name: 'tribute',
  title: 'Tributes',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Full Name',
      type: 'string',
      validation: (rule) => rule.required().min(2).max(100),
    }),
    defineField({
      name: 'email',
      title: 'Email Address',
      type: 'string',
      description: 'Private — for the family to reach out if needed.',
    }),
    defineField({
      name: 'relationship',
      title: 'Relationship to Tersoo',
      type: 'string',
      options: {
        list: [
          'Family',
          'Close Friend',
          'Friend',
          'Colleague',
          'Neighbor',
          'Classmate',
          'Teacher / Mentor',
          'Community Member',
          'Other',
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'message',
      title: 'Tribute / Condolence Message',
      type: 'text',
      rows: 5,
      validation: (rule) => rule.required().min(10).max(5000),
    }),
    defineField({
      name: 'photos',
      title: 'Photos',
      type: 'array',
      of: [{ type: 'image' }],
      options: { layout: 'grid' },
    }),
    defineField({
      name: 'submittedAt',
      title: 'Submitted At',
      type: 'datetime',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'approved',
      title: 'Approved',
      type: 'boolean',
      description: 'Toggle on to display this tribute publicly on the page.',
      initialValue: false,
    }),
  ],

  orderings: [
    {
      title: 'Newest First',
      name: 'submittedAtDesc',
      by: [{ field: 'submittedAt', direction: 'desc' }],
    },
  ],

  preview: {
    select: {
      title: 'name',
      subtitle: 'relationship',
      media: 'photos.0',
    },
  },
});
