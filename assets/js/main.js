// Main JavaScript - Serenity by Saule

document.addEventListener('DOMContentLoaded', () => {

    // Mobile Menu Toggle
    // Mobile Menu Toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const links = document.querySelectorAll('.nav-links a');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('nav-active');

            // Toggle Hamburger Icon (Optional: animate to X)
            if (navLinks.classList.contains('nav-active')) {
                mobileMenuToggle.textContent = '✕';
                document.body.style.overflow = 'hidden'; // Prevent scrolling
            } else {
                mobileMenuToggle.textContent = '☰';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // Close menu when a link is clicked
    links.forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('nav-active')) {
                navLinks.classList.remove('nav-active');
                mobileMenuToggle.textContent = '☰';
                document.body.style.overflow = 'auto';
            }
        });
    });

    // Smooth Scroll for specific internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    console.log('Serenity - Experience Loaded');
});
