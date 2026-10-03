alter table crm_abvcap.contacts
  add column title text,
  drop column languages,
  drop column linkedin_url;
