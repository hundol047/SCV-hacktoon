# The cron build context contains the extracted, APT-verified Debian pg_cron 1.6.5 package.
FROM postgres:17-trixie
COPY --from=cron /usr/lib/postgresql/17/lib/pg_cron.so /usr/lib/postgresql/17/lib/pg_cron.so
COPY --from=cron /usr/share/postgresql/17/extension/ /usr/share/postgresql/17/extension/
