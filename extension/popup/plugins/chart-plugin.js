// Plugin that I absolutely did steal from stack overflow which creates a centre text on the doughnut and colours it according to the sites overall score
export const enhancedCenterTextPlugin = {
    id: 'enhancedCenterText',
    beforeDraw(chart) {
        const { ctx, chartArea: { left, top, width, height } } = chart;
        const data = chart.data.datasets[0].data;
        const validScores = data.filter(score => score !== null && score !== undefined);
       
        // only scores uses a slice to take all scores included except the last one so that when the final value is calculated it is - the empty segment
        let onlyScores = data.slice(0, -1)

        // data.length - 1 because we don't want to include the empty segment in our total scoring
        const maxPossibleScore = (data.length-1) * 10; 
        
        // Slight modification here so that the score is dynamically updated to reflect new tests being added
        const highScore = maxPossibleScore*0.9
        const midScore = maxPossibleScore*0.7

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