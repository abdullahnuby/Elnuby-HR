import type { Project, Employee } from './types';
import { Empty } from './common';
export default function Projects({
  projects,
  employees,
  managerMode,
  projectForm,
  setProjectForm,
  createProject,
  busy,
  onEdit,
}: {
  projects: Project[];
  employees: Employee[];
  managerMode: boolean;
  projectForm: any;
  setProjectForm: any;
  createProject: () => void;
  busy: boolean;
  onEdit?: (projectId: string) => void;
}) {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>المشاريع</h2>
          <p>
            إنشاء وإدارة مواقع المشاريع
            وإحداثيات الـ GPS ونطاق الحضور.
          </p>
        </div>

        <span className="count-pill">
          {projects.length} مشروع
        </span>
      </div>

      {!managerMode && (
        <div className="request-card">
          <h3>
            إضافة مشروع جديد
          </h3>

          <div className="formgrid">
            <input
              placeholder="اسم المشروع *"
              value={projectForm.name}
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  name: e.target.value,
                })
              }
            />

            <input
              placeholder="العميل"
              value={projectForm.client}
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  client: e.target.value,
                })
              }
            />

            <input
              placeholder="اسم الموقع"
              value={
                projectForm.location_name
              }
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  location_name:
                    e.target.value,
                })
              }
            />

            <input
              type="number"
              step="any"
              placeholder="Latitude *"
              value={
                projectForm.latitude
              }
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  latitude:
                    e.target.value,
                })
              }
            />

            <input
              type="number"
              step="any"
              placeholder="Longitude *"
              value={
                projectForm.longitude
              }
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  longitude:
                    e.target.value,
                })
              }
            />

            <input
              type="number"
              placeholder="نطاق GPS بالمتر"
              value={
                projectForm.geofence_radius_m
              }
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  geofence_radius_m:
                    e.target.value,
                })
              }
            />
          </div>

          <button
            className="primary"
            disabled={busy}
            onClick={createProject}
          >
            إنشاء المشروع
          </button>
        </div>
      )}

      <div className="project-cards">
        {projects.map((p) => {
          const assigned =
            employees.filter(
              (e) =>
                String(
                  e.project_id || '',
                ) ===
                String(p.project_id),
            );

          return (
            <div
              className="project-card"
              key={p.project_id}
            >
              <div className="project-icon">
                ▦
              </div>

              <div className="project-card-main">
                <h3>
                  {p.name ||
                    p.project_id}
                </h3>

                <p>
                  {p.location_name ||
                    'الموقع غير محدد'}{' '}
                  {p.client
                    ? `• ${p.client}`
                    : ''}
                </p>

                <div className="project-meta">
                  <span>
                    {p.status ||
                      'ACTIVE'}
                  </span>

                  <span>
                    👷 {p.employee_count ?? assigned.length}{' '}
                    موظف
                  </span>

                  <span>
                    مديرو المشروع:{' '}
                    {(p.managers || [])
                      .map(
                        (m: any) =>
                          m.name ||
                          m.username,
                      )
                      .filter(Boolean)
                      .join('، ') ||
                      'غير محدد'}
                  </span>

                  <span>
                    GPS {p.latitude},{' '}
                    {p.longitude}
                  </span>

                  <span>
                    {p.geofence_radius_m ||
                      200}
                    m
                  </span>
                </div>

                {onEdit && <button className="secondary" disabled={busy} onClick={() => onEdit(p.project_id)}>تعديل المشروع</button>}

                <div className="project-workers">
                  {assigned
                    .slice(0, 6)
                    .map((e) => (
                      <span
                        key={
                          e.employee_id
                        }
                        title={e.name}
                      >
                        {e.name}
                      </span>
                    ))}

                  {assigned.length > 6 && (
                    <span>
                      +{assigned.length - 6}
                    </span>
                  )}

                  {!assigned.length && (
                    <span>
                      لا يوجد موظفون معينون
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!projects.length && (
        <Empty text="لا توجد مشاريع مسجلة حتى الآن. أضف أول مشروع من النموذج أعلاه." />
      )}
    </section>
  );
}

