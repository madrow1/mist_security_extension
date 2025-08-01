// Chart.js plugins
export const enhancedCenterTextPlugin = {
    id: 'enhancedCenterText',
    beforeDraw(chart) {
        const { ctx, chartArea: { left, top, width, height } } = chart;
        const data = chart.data.datasets[0].data;
        const validScores = data.filter(score => score !== null && score !== undefined);
       
        let onlyScores = data.slice(0, -1);
        const maxPossibleScore = (data.length-1) * 10; 
        const highScore = maxPossibleScore * 0.9;
        const midScore = maxPossibleScore * 0.7;
        const totalPoints = onlyScores.reduce((sum, value) => sum + (value || 0), 0);
        
        let scoreColor = '#d32f2f'; // Red for low scores
        if (totalPoints >= highScore) scoreColor = '#2D6A00'; // Green for high scores
        else if (totalPoints >= midScore) scoreColor = '#f57f17'; // Yellow for medium scores
        
        ctx.save();
        
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        
        // Draw circular background
        ctx.beginPath();
        ctx.arc(centerX, centerY, 60, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.strokeStyle = scoreColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw main score as points/max
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = scoreColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${totalPoints}/${maxPossibleScore}`, centerX, centerY - 5);
        
        // Draw label
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('TOTAL POINTS', centerX, centerY + 20);
        
        ctx.restore();
    }
};