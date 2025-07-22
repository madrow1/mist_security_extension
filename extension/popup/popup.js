document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.action-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.action-button').forEach(btn => btn.classList.remove('clicked'));

            button.classList.add('clicked');

            const action = button.getAttribute('data-action');
            chrome.runtime.sendMessage({ action }, (response) => {
                if (chrome.runtime.lastError) {
                console.error("Error:", chrome.runtime.lastError.message);
                return;
                } 
                
                console.log(`${action} result:`, response);
                document.querySelector('.popup-content').textContent = JSON.stringify(response, null, 2);
            });
        });
    });
});