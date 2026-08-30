import React from "react";

export default class ClientErrorBoundary extends React.Component<React.PropsWithChildren, {hasError:boolean}> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error("ELNUBY HR client error:", error); }
  render() {
    if (this.state.hasError) return <section className="panel page-panel" dir="rtl"><div className="state-card error-state"><div><strong>تعذر عرض الصفحة الحالية</strong><span>حدث خطأ غير متوقع في الواجهة. أعد المحاولة من خلال تحديث الصفحة.</span></div><button className="secondary" onClick={() => window.location.reload()}>إعادة المحاولة</button></div></section>;
    return this.props.children;
  }
}
