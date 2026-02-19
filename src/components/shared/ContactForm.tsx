'use client';

import { useState } from 'react';

export default function ContactForm() {
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('sending');
        try {
                const res = await fetch('https://formspree.io/f/xlgwlvag', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                          body: JSON.stringify(form),
                });
                if (res.ok) {
                          setStatus('success');
                          setForm({ name: '', email: '', message: '' });
                } else {
                          setStatus('error');
                }
        } catch {
                setStatus('error');
        }
  };

  return (
        <section className="max-w-lg mx-auto py-12 px-4">
              <h2 className="text-2xl font-bold mb-6 text-center">문의하기</h2>h2>
          {status === 'success' ? (
                  <p className="text-green-600 text-center font-semibold py-8">
                            ✅ 문의가 접수되었습니다! 빠르게 답변드릴게요.
                  </p>p>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <input
                                          type="text"
                                          name="name"
                                          placeholder="이름"
                                          value={form.name}
                                          onChange={handleChange}
                                          required
                                          className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        />
                            <input
                                          type="email"
                                          name="email"
                                          placeholder="이메일"
                                          value={form.email}
                                          onChange={handleChange}
                                          required
                                          className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        />
                            <textarea
                                          name="message"
                                          placeholder="문의 내용을 입력해주세요"
                                          value={form.message}
                                          onChange={handleChange}
                                          required
                                          rows={5}
                                          className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                        />
                            <button
                                          type="submit"
                                          disabled={status === 'sending'}
                                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
                                        >
                              {status === 'sending' ? '전송 중...' : '문의 보내기'}
                            </button>button>
                    {status === 'error' && (
                                <p className="text-red-500 text-center text-sm">전송 실패. 잠시 후 다시 시도해주세요.</p>p>
                            )}
                  </form>form>
              )}
        </section>section>
      );
}</section>
