update reports
set status = 'new'
where status::text = 'in_review';

alter type report_status rename to report_status_old;

create type report_status as enum ('new', 'resolved', 'dismissed');

alter table reports
  alter column status drop default;

alter table reports
  alter column status type report_status
  using status::text::report_status;

alter table reports
  alter column status set default 'new';

drop type report_status_old;

alter table moderation_actions
  alter column anchor_user_id drop not null;
