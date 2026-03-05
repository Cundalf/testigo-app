// =====================================================
// TESTIGO — Landing Page
// =====================================================

function renderLanding() {
    app.innerHTML = `
        <div class="landing">
            <div class="landing-hero">
                <h1 class="landing-title">TESTIGO</h1>
                <p class="landing-subtitle">La app que no te perdona</p>
            </div>

            <div class="landing-quote" id="landing-quote"></div>

            <div class="landing-divider"></div>

            <div class="landing-manifesto">
                <p>Definís tus compromisos diarios. Sin excepción.</p>
                <p>Cada día, la app genera tus tareas. Sin negociación.</p>
                <p>Si fallás, escribís tu excusa. Sin escapatoria.</p>
                <p>Un juez estoico evalúa tu justificación. Sin piedad.</p>
                <p>Si tu excusa es débil, recibís un castigo. Sin apelación.</p>
            </div>

            <div class="landing-divider"></div>

            <div class="landing-cta">
                <button onclick="navigate('login')">ENTRAR</button>
            </div>

            <div style="margin-top:3rem; color:#333; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.2em;">
                // Sin rachas. Sin badges. Sin motivación barata.
            </div>
        </div>
    `;

    const quoteEl = document.getElementById("landing-quote");
    startQuoteRotation(quoteEl, 25000);
}
