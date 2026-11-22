import { Link } from 'react-router';
import './welcome.scss';

const WelcomePage = () => (
    <main className='welcome-page'>
        <header className='welcome-page__header'>
            <Link className='welcome-page__brand' to='/' aria-label='ViiTrader home'>
                <span className='welcome-page__brand-mark' aria-hidden='true'>
                    V
                </span>
                <span>ViiTrader</span>
            </Link>
            <Link className='welcome-page__header-link' to='/trade'>
                Open trader <span aria-hidden='true'>↗</span>
            </Link>
        </header>

        <section className='welcome-page__hero'>
            <div className='welcome-page__copy'>
                <p className='welcome-page__eyebrow'>
                    <span aria-hidden='true' /> YOUR NEXT MOVE STARTS HERE
                </p>
                <h1>
                    See the market
                    <br />
                    <span>in a new light.</span>
                </h1>
                <p className='welcome-page__description'>
                    Welcome to ViiTrader — a clearer space to explore the markets and build your trading
                    experience.
                </p>
                <div className='welcome-page__actions'>
                    <Link className='welcome-page__button' to='/trade'>
                        Enter ViiTrader <span aria-hidden='true'>→</span>
                    </Link>
                    <span className='welcome-page__note'>A better view starts with a single step.</span>
                </div>
            </div>

            <div className='welcome-page__visual' aria-label='Illustration of a rising market chart' role='img'>
                <div className='welcome-page__visual-glow' />
                <div className='welcome-page__chart-card'>
                    <div className='welcome-page__chart-top'>
                        <div>
                            <span className='welcome-page__chart-label'>MARKET OVERVIEW</span>
                            <strong>Market movement</strong>
                        </div>
                        <span className='welcome-page__chart-period'>MARKET VIEW</span>
                    </div>
                    <div className='welcome-page__chart'>
                        <div className='welcome-page__chart-grid' />
                        <svg viewBox='0 0 520 230' role='presentation' focusable='false'>
                            <defs>
                                <linearGradient id='welcome-chart-fill' x1='0' x2='0' y1='0' y2='1'>
                                    <stop offset='0%' stopColor='#f2c65d' stopOpacity='.3' />
                                    <stop offset='100%' stopColor='#f2c65d' stopOpacity='0' />
                                </linearGradient>
                            </defs>
                            <path
                                d='M0 188 C36 182 46 148 81 158 S129 179 158 136 S208 151 234 112 S282 126 316 86 S365 104 391 67 S441 76 466 41 S498 53 520 17 V230 H0Z'
                                fill='url(#welcome-chart-fill)'
                            />
                            <path
                                d='M0 188 C36 182 46 148 81 158 S129 179 158 136 S208 151 234 112 S282 126 316 86 S365 104 391 67 S441 76 466 41 S498 53 520 17'
                                fill='none'
                                stroke='#f2c65d'
                                strokeLinecap='round'
                                strokeWidth='4'
                            />
                            <circle cx='520' cy='17' r='6' fill='#fff0bd' />
                        </svg>
                    </div>
                    <div className='welcome-page__chart-bottom'>
                        <span>DISCOVER</span>
                        <span>ANALYZE</span>
                        <span>TAKE YOUR NEXT STEP</span>
                    </div>
                </div>
                <div className='welcome-page__floating-tag'>
                    <span aria-hidden='true'>✦</span> A fresh perspective
                </div>
            </div>
        </section>

        <footer className='welcome-page__footer'>
            <span>ViiTrader</span>
            <span>Explore markets at your own pace.</span>
        </footer>
    </main>
);

export default WelcomePage;
