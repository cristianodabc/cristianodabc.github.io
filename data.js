// Content for the Technologies section and the Elixir ecosystem tabs.
window.SITE_DATA = (function () {
  const steps = [
    { key: 'elixir', name: 'Elixir', category: 'language', diagramLabel: 'supervision tree', title: 'Built on Elixir', desc: 'Applications written in Elixir. Lightweight processes and supervision keep services responsive and able to recover on their own.', points: ['Lightweight, isolated processes', 'Supervisors restart failed parts', 'Built for real-time and concurrency'] },
    { key: 'eventsourcing', name: 'Event sourcing', category: 'architecture', diagramLabel: 'command to read model', title: 'Modeled as events', desc: 'State is stored as a sequence of immutable events, with Commanded handling commands, aggregates and projections. Every change is recorded, so history can be audited and read models rebuilt at any time.', points: ['Every change recorded as an event', 'Read models rebuilt from the event log', 'Schema changes handled by event upcasting'] },
    { key: 'postgres', name: 'PostgreSQL', category: 'database', diagramLabel: 'data access', title: 'Data in PostgreSQL', desc: 'A dependable relational database, used through Ecto for safe, composable queries.', points: ['Transactional guarantees', 'Migrations under version control', 'Connection pooling built in'] },
    { key: 'docker', name: 'Docker', category: 'containers', diagramLabel: 'delivery pipeline', title: 'Packaged with Docker', desc: 'The release is packaged into a container image, so it runs the same on a laptop, in CI and in production.', points: ['Same image in dev, CI and production', 'Reproducible builds', 'Simple rollbacks'] },
    { key: 'cicd', name: 'CI/CD', category: 'delivery', diagramLabel: 'pipeline', title: 'Automated delivery', desc: 'Every change is tested and built automatically, then deployed the same way each time.', points: ['Tests on every change', 'Reproducible builds', 'Fast, repeatable releases'] },
    { key: 'terraform', name: 'Terraform', category: 'infrastructure', diagramLabel: 'plan and apply', title: 'Provisioned with Terraform', desc: 'Infrastructure is described in code, reviewed like any other change and applied the same way every time.', points: ['Infrastructure defined in code', 'Changes reviewed before they apply', 'Repeatable environments'] },
    { key: 'gcp', name: 'Google Cloud', category: 'cloud', diagramLabel: 'runtime architecture', title: 'Running on Google Cloud', desc: 'The container is deployed to Google Cloud, where Cloud Run runs and scales it, with Pub/Sub and Cloud Storage alongside for events and files.', points: ['Cloud Run for hosting', 'Pub/Sub and Cloud Storage for events and files', 'Scales with traffic'] },
    { key: 'observability', name: 'Observability', category: 'monitoring', diagramLabel: 'signal flow', title: 'Seeing what is happening', desc: 'Telemetry events from the application feed metrics, traces and logs, so problems surface before users report them.', points: ['Metrics, traces and logs', 'Dashboards and alerts', 'Telemetry built into the ecosystem'] }
  ];

  const groups = [
    { name: 'Web', children: [{ name: 'Phoenix Endpoint', sub: 'HTTP and WebSocket' }, { name: 'LiveView', sub: 'one process per session' }] },
    { name: 'Data', children: [{ name: 'Ecto Repo', sub: 'database pool' }, { name: 'Oban', sub: 'background jobs' }] },
    { name: 'Events', children: [{ name: 'Broadway', sub: 'data pipelines' }, { name: 'PubSub', sub: 'messaging' }] }
  ];

  const elixirCode = [
`defmodule MyAppWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :my_app

  socket "/live", Phoenix.LiveView.Socket
  plug MyAppWeb.Router
end`,
`def mount(_params, _session, socket) do
  if connected?(socket), do: Phoenix.PubSub.subscribe(MyApp.PubSub, "orders")
  {:ok, assign(socket, orders: [])}
end`,
`defmodule MyApp.Repo do
  use Ecto.Repo,
    otp_app: :my_app,
    adapter: Ecto.Adapters.Postgres
end`,
`config :my_app, Oban,
  repo: MyApp.Repo,
  queues: [payouts: 10, default: 5]

%{batch_id: id} |> MyApp.PayoutWorker.new() |> Oban.insert()`,
`Broadway.start_link(__MODULE__,
  name: __MODULE__,
  producer: [module: {BroadwayCloudPubSub.Producer, subscription: sub}],
  processors: [default: [concurrency: 10]]
)`,
`{Phoenix.PubSub, name: MyApp.PubSub}

Phoenix.PubSub.broadcast(MyApp.PubSub, "orders", {:order_paid, id})`
  ];

  // Node subtitles for gcp depend on live state, so diagrams are built by a function.
  const diagrams = (s) => {
    const inst = s.traffic === 'High' ? 4 : 1;
    return {
      docker: {
        traceLabel: 'Push a commit', path: ['git', 'ci', 'reg', 'host', 'app'],
        nodes: [
          { id: 'git', name: 'Git repo', sub: 'commit pushed', desc: 'Every change starts as a commit. A push triggers the pipeline.' },
          { id: 'ci', name: 'CI runner', sub: 'build and test', chips: ['layer cache'], desc: 'Builds the Elixir release inside a container and runs the tests against it. Unchanged layers come from the cache, so most rebuilds are quick.' },
          { id: 'reg', name: 'Registry', sub: 'stores images', chips: ['version tags'], desc: 'The image is pushed with a version tag. Older tags stay available, so a rollback is just a redeploy.' },
          { id: 'host', name: 'Container host', sub: 'pulls the image', desc: 'Hosts pull the exact image that CI tested.' },
          { id: 'app', name: 'Elixir app', sub: 'release', doneSub: 'running', desc: 'The release starts inside the container and runs under its supervision tree.' }
        ],
        zones: [{ label: 'Build', c: '1 / 4' }, { label: 'Ship', c: '5 / 6' }, { label: 'Run', c: '7 / 10' }]
      },
      eventsourcing: {
        traceLabel: 'Send a command', path: ['cmd', 'agg', 'store', 'proj', 'read'],
        nodes: [
          { id: 'cmd', name: 'Command', sub: 'a request to change state', desc: 'A command, such as reserving credit, arrives from the web layer or a message consumer. It states an intent and is validated before anything is recorded.' },
          { id: 'agg', name: 'Aggregate', sub: 'validates and decides', chips: ['business rules'], desc: 'The aggregate, a long-lived Elixir process, checks the command against its current state and decides which events to emit. An invalid command is rejected and nothing is written.' },
          { id: 'store', name: 'Event store', sub: 'append-only log', doneSub: 'event appended', chips: ['append-only', 'upcasting'], desc: 'Accepted events are appended to PostgreSQL and never edited. When an event changes shape, upcasting converts old events as they are read, so history stays valid.' },
          { id: 'proj', name: 'Projection', sub: 'builds read models', chips: ['handlers'], desc: 'Event handlers subscribe to the log and update the read models. Process managers react to events and coordinate multi-step workflows, with compensation when a step fails.' },
          { id: 'read', name: 'Read model', sub: 'queryable tables', doneSub: 'up to date', desc: 'Ordinary Ecto tables shaped for queries, dashboards and APIs. Because they derive from the events, they can be dropped and rebuilt.' }
        ],
        zones: [{ label: 'Write side', c: '1 / 6' }, { label: 'Read side', c: '7 / 10' }]
      },
      terraform: {
        traceLabel: 'Run plan', gate: 'approve', path: ['code', 'plan', 'approve', 'apply', 'cloud'],
        nodes: [
          { id: 'code', name: 'main.tf', sub: 'desired state', desc: 'You describe the infrastructure you want in version-controlled .tf files.' },
          { id: 'plan', name: 'Plan', sub: 'what will change', chips: ['state'], desc: 'Terraform compares your files with the recorded state and lists exactly what would change.' },
          { id: 'approve', name: 'Approval', sub: 'a person reviews', desc: 'Someone reviews the plan before anything is changed. Select Approve to continue the run.' },
          { id: 'apply', name: 'Apply', sub: 'make changes', desc: 'Once approved, Terraform makes the changes in dependency order and updates its state.' },
          { id: 'cloud', name: 'Google Cloud', sub: 'real resources', doneSub: 'resources created', desc: 'Networks, databases and services are created or updated on Google Cloud.' }
        ],
        zones: [{ label: 'Repository', c: '1 / 2' }, { label: 'Terraform', c: '3 / 8' }, { label: 'Google Cloud', c: '9 / 10' }]
      },
      gcp: {
        traceLabel: 'Send a request', path: ['users', 'lb', 'svc', 'db'],
        nodes: [
          { id: 'users', name: 'Users', sub: 'requests', desc: 'Requests arrive from browsers and other clients.' },
          { id: 'lb', name: 'Load balancer', sub: s.gFail ? 'routing around it' : 'routes traffic', chips: ['health checks'], desc: 'Spreads requests across healthy instances. Health checks take unhealthy ones out of rotation.' },
          { id: 'svc', name: 'Cloud Run', sub: inst + (inst > 1 ? ' instances' : ' instance'), chips: ['autoscaler'], bars: inst, desc: 'Your Elixir release runs on Cloud Run as containers. The autoscaler adds instances when traffic rises and removes them when it falls.' },
          { id: 'db', name: 'Database', sub: 'stores data', desc: 'Application data lives in a managed database, separate from the containers.' }
        ],
        zones: [{ label: 'Google Cloud', c: '3 / 8' }]
      },
      postgres: {
        traceLabel: 'Run a query', path: ['app', 'ecto', 'pool', 'pg'],
        nodes: [
          { id: 'app', name: 'Elixir app', sub: 'needs data', desc: 'A request needs data, so the application asks the database through Ecto.' },
          { id: 'ecto', name: 'Ecto', sub: 'queries and changesets', chips: ['migrations'], desc: 'Ecto builds composable queries, validates incoming data with changesets and runs migrations that live in version control.' },
          { id: 'pool', name: 'Connection pool', sub: 'reuses connections', desc: 'A pool of open connections is shared across requests, so none of them pays the cost of connecting.' },
          { id: 'pg', name: 'PostgreSQL', sub: 'stores data', doneSub: 'result returned', chips: ['transactions'], desc: 'PostgreSQL stores the data with transactional guarantees and returns the result to the application.' }
        ],
        zones: [{ label: 'Application', c: '1 / 6' }, { label: 'Database', c: '7 / 8' }]
      },
      cicd: {
        traceLabel: 'Push a commit', path: ['push', 'test', 'build', 'deploy'],
        nodes: [
          { id: 'push', name: 'Commit', sub: 'pushed to the repo', chips: ['GitHub Actions'], desc: 'A change is pushed to the repository, which starts the pipeline automatically.' },
          { id: 'test', name: 'Tests', sub: 'run on every change', chips: ['mix test'], desc: 'The test suite runs on every change, so regressions are caught before they ship.' },
          { id: 'build', name: 'Build', sub: 'image built', chips: ['docker'], desc: 'A container image is built from the tested code, the same way every time.' },
          { id: 'deploy', name: 'Deploy', sub: 'to Cloud Run', doneSub: 'released', desc: 'The image is rolled out to Cloud Run on Google Cloud, and a previous version can be redeployed if something goes wrong.' }
        ],
        zones: [{ label: 'Continuous integration', c: '3 / 6' }, { label: 'Delivery', c: '7 / 8' }]
      },
      observability: {
        traceLabel: 'Emit an event', path: ['app', 'telemetry', 'collector', 'dash'],
        nodes: [
          { id: 'app', name: 'Elixir app', sub: 'emits events', desc: 'The application and its libraries emit events as they work.' },
          { id: 'telemetry', name: 'Telemetry', sub: 'metrics and traces', desc: 'Telemetry is the standard way Elixir libraries report metrics and traces, so most of the ecosystem is instrumented out of the box.' },
          { id: 'collector', name: 'Collector', sub: 'gathers signals', desc: 'Signals are gathered in one place and forwarded to the monitoring tools.' },
          { id: 'dash', name: 'Dashboards', sub: 'and alerts', doneSub: 'visible', desc: 'Metrics, traces and logs are shown on dashboards, and alerts fire when something looks wrong.' }
        ],
        zones: [{ label: 'Application', c: '1 / 4' }, { label: 'Monitoring', c: '5 / 8' }]
      }
    };
  };

  const code = {
    'docker:git': ['bash', `git push origin main`],
    'docker:ci': ['dockerfile', `FROM hexpm/elixir:<version> AS build
COPY . .
RUN mix deps.get --only prod && mix release`],
    'docker:reg': ['bash', `docker push europe-docker.pkg.dev/my-project/app/api:1.4.2`],
    'docker:host': ['bash', `docker run --rm -p 4000:4000 app/api:1.4.2`],
    'docker:app': ['elixir', `def start(_type, _args) do
  Supervisor.start_link(children(), strategy: :one_for_one)
end`],
    'terraform:code': ['hcl', `resource "google_cloud_run_v2_service" "api" {
  name     = "api"
  location = var.region
}`],
    'terraform:plan': ['bash', `terraform plan -out=tfplan`],
    'terraform:approve': ['bash', `# a person reads the plan first
terraform show tfplan`],
    'terraform:apply': ['bash', `terraform apply tfplan`],
    'terraform:cloud': ['output', `google_cloud_run_v2_service.api: Creation complete
Apply complete! Resources: 1 added, 0 changed, 0 destroyed.`],
    'gcp:users': ['http', `GET https://api.example.com/health`],
    'gcp:lb': ['hcl', `resource "google_compute_health_check" "api" {
  http_health_check {
    request_path = "/health"
  }
}`],
    'gcp:svc': ['hcl', `scaling {
  min_instance_count = 1
  max_instance_count = 10
}`],
    'gcp:db': ['elixir', `config :my_app, MyApp.Repo,
  url: System.fetch_env!("DATABASE_URL"),
  pool_size: 10`],
    'postgres:app': ['elixir', `MyApp.Orders.get_order!(id)`],
    'postgres:ecto': ['elixir', `from(o in Order, where: o.status == :paid, preload: :items)
|> Repo.all()`],
    'postgres:pool': ['elixir', `config :my_app, MyApp.Repo, pool_size: 10`],
    'postgres:pg': ['sql', `SELECT id, status FROM orders WHERE status = 'paid';`],
    'cicd:push': ['yaml', `on:
  push:
    branches: [main]`],
    'cicd:test': ['bash', `mix format --check-formatted
mix test`],
    'cicd:build': ['bash', `docker build -t api:$GITHUB_SHA .`],
    'cicd:deploy': ['bash', `gcloud run deploy api --image europe-docker.pkg.dev/my-project/app/api:$GITHUB_SHA`],
    'observability:app': ['elixir', `:telemetry.execute([:my_app, :payment, :settled], %{amount: 1250}, %{currency: "USD"})`],
    'observability:telemetry': ['elixir', `:telemetry.attach("log-payments", [:my_app, :payment, :settled], &Handler.handle/4, nil)`],
    'observability:collector': ['elixir', `config :opentelemetry_exporter,
  otlp_protocol: :http_protobuf,
  otlp_endpoint: "http://collector:4318"`],
    'observability:dash': ['promql', `rate(payment_settled_total[5m])`],
    'eventsourcing:cmd': ['elixir', `%ReserveCredit{account_id: id, amount: 5_000}
|> MyApp.App.dispatch()`],
    'eventsourcing:agg': ['elixir', `def execute(%Account{} = acct, %ReserveCredit{amount: amt}) do
  if acct.available >= amt,
    do: %CreditReserved{account_id: acct.id, amount: amt},
    else: {:error, :insufficient_credit}
end`],
    'eventsourcing:store': ['elixir', `defimpl Commanded.Event.Upcaster, for: CreditReserved do
  def upcast(%{currency: nil} = e, _), do: %{e | currency: "USD"}
  def upcast(e, _), do: e
end`],
    'eventsourcing:proj': ['elixir', `project(%CreditReserved{} = e, _meta, fn multi ->
  Ecto.Multi.insert(multi, :row, %CreditRow{account_id: e.account_id, amount: e.amount})
end)`],
    'eventsourcing:read': ['elixir', `Repo.all(from c in CreditRow, where: c.account_id == ^id)`]
  };

  const eco = [
    { label: 'Web & APIs', tools: [
      { name: 'Phoenix', desc: 'Web framework for fast, real-time applications.' },
      { name: 'LiveView', desc: 'Interactive, real-time interfaces rendered on the server, with no separate front end.' },
      { name: 'Plug', desc: 'Composable building blocks for HTTP pipelines, authentication and webhooks.' },
      { name: 'Absinthe', desc: 'GraphQL toolkit for typed, self-documenting APIs.' },
      { name: 'Req', desc: 'A batteries-included HTTP client for integrations with banks and third-party APIs.' }
    ] },
    { label: 'Data', tools: [
      { name: 'Ecto', desc: 'Database toolkit for safe, composable queries, changesets and migrations.' },
      { name: 'Postgrex', desc: 'The PostgreSQL driver beneath Ecto, with connection pooling built in.' },
      { name: 'Redix', desc: 'A fast, pipelined Redis client for caching and short-lived state.' }
    ] },
    { label: 'Events & jobs', tools: [
      { name: 'Commanded', desc: 'CQRS and event sourcing: commands, aggregates, projections and process managers.' },
      { name: 'EventStore', desc: 'An append-only event store on PostgreSQL, with streams and subscriptions.' },
      { name: 'Oban', desc: 'Reliable background jobs stored in PostgreSQL, with retries, scheduling and dependencies.' },
      { name: 'Broadway', desc: 'Concurrent data ingestion from queues and Pub/Sub, with back-pressure built in.' },
      { name: 'GenStage', desc: 'Back-pressure-aware pipelines between producers and consumers.' }
    ] },
    { label: 'Runtime', tools: [
      { name: 'OTP', desc: 'Building blocks for concurrent, fault-tolerant systems: processes, supervisors and state machines.' },
      { name: 'Mix releases', desc: 'Self-contained releases that package the app and the runtime for deployment.' },
      { name: 'Telemetry', desc: 'The standard way libraries report metrics and traces, so most of the stack is observable out of the box.' },
      { name: 'OpenTelemetry', desc: 'Distributed traces and metrics exported to the monitoring stack.' },
      { name: 'LiveDashboard', desc: 'A live view of processes, memory and metrics inside a running Phoenix app.' }
    ] },
    { label: 'Quality', tools: [
      { name: 'ExUnit', desc: 'The built-in test framework, with async tests and doctests.' },
      { name: 'Mox', desc: 'Explicit, concurrent mocks based on behaviours.' },
      { name: 'StreamData', desc: 'Property-based testing and data generation.' },
      { name: 'Credo', desc: 'Static analysis for consistency and readability.' },
      { name: 'Dialyxir', desc: 'Dialyzer type checks wired into the build.' }
    ] }
  ];

  return { steps, groups, elixirCode, diagrams, code, eco };
})();
