import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { Button, TextField } from '@/components/ui';
import { ApiError } from '@/lib/api';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) navigate('/', { replace: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-cream p-4">
      <div className="w-full max-w-sm">
        {/* بطاقة تسجيل الدخول */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-pop">
          {/* رأس البطاقة الخضراء */}
          <div className="bg-brand-700 px-8 py-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white ring-2 ring-white/40 overflow-hidden shadow-pop">
              <img
                src="/logo.png"
                alt="شعار الجمعية"
                className="h-full w-full object-contain p-1"
                onError={(e) => {
                  const t = e.currentTarget;
                  t.style.display = 'none';
                  (t.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'block');
                }}
              />
              <span className="hidden text-3xl font-bold text-white">ق</span>
            </div>
            <h1 className="mt-4 text-xl font-extrabold tracking-wide text-white">الحلقات الصيفية لعام 1448هـ</h1>
            <p className="mt-1 text-sm text-white/70">الجمعية الخيرية لتحفيظ القرآن الكريم بجازان</p>
          </div>

          {/* نموذج الدخول */}
          <form onSubmit={submit} className="space-y-4 p-6">
            <TextField
              label="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
            <div className="relative">
              <TextField
                label="كلمة المرور"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute bottom-2.5 left-3 text-xs text-muted hover:text-ink"
              >
                {show ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
            {error && (
              <div className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
            )}
            <Button type="submit" size="lg" loading={loading} className="w-full">
              دخول
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          نظام متابعة الحلقات الصيفية لعام 1448هـ
        </p>
      </div>
    </div>
  );
}
