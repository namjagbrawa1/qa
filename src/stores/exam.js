import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// API 基础URL
const API_BASE_URL = 'http://localhost:3001/api'

// API 工具函数
const apiRequest = async (url, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('API request failed:', error)
    throw error
  }
}

// API 服务
const api = {
  // 题目相关API
  async getQuestions() {
    return await apiRequest('/questions')
  },
  
  async createQuestion(question) {
    return await apiRequest('/questions', {
      method: 'POST',
      body: JSON.stringify({
        title: question.question,
        type: question.type,
        options: question.options,
        correctAnswer: Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer],
        score: question.score
      })
    })
  },
  
  async updateQuestion(id, question) {
    return await apiRequest(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: question.question,
        type: question.type,
        options: question.options,
        correctAnswer: Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer],
        score: question.score
      })
    })
  },
  
  async deleteQuestion(id) {
    return await apiRequest(`/questions/${id}`, {
      method: 'DELETE'
    })
  },
  
  // 试卷相关API
  async getExams() {
    return await apiRequest('/exams')
  },
  
  async createExam(exam) {
    return await apiRequest('/exams', {
      method: 'POST',
      body: JSON.stringify(exam)
    })
  },
  
  async deleteExam(id) {
    return await apiRequest(`/exams/${id}`, {
      method: 'DELETE'
    })
  },
  
  // 考试记录相关API
  async getExamRecords() {
    return await apiRequest('/exam-records')
  },
  
  async createExamRecord(record) {
    return await apiRequest('/exam-records', {
      method: 'POST',
      body: JSON.stringify(record)
    })
  }
}

export const useExamStore = defineStore('exam', () => {
  // 响应式数据
  const questions = ref([])
  const exams = ref([])
  const examRecords = ref([])
  const loading = ref(false)
  const error = ref(null)

  // 计算属性
  const totalQuestions = computed(() => questions.value.length)
  const totalExams = computed(() => exams.value.length)
  const totalParticipants = computed(() => examRecords.value.length)

  // 数据转换函数：将API数据转换为前端格式
  const transformQuestion = (apiQuestion) => ({
    id: apiQuestion.id,
    type: apiQuestion.type,
    question: apiQuestion.title,
    options: apiQuestion.options,
    correctAnswer: apiQuestion.type === 'single' ? apiQuestion.correctAnswer[0] : apiQuestion.correctAnswer,
    score: apiQuestion.score
  })

  // 初始化数据
  const initializeData = async () => {
    loading.value = true
    error.value = null
    
    try {
      const [questionsData, examsData, recordsData] = await Promise.all([
        api.getQuestions(),
        api.getExams(),
        api.getExamRecords()
      ])
      
      questions.value = questionsData.map(transformQuestion)
      exams.value = examsData
      examRecords.value = recordsData
    } catch (err) {
      error.value = err.message
      console.error('Failed to initialize data:', err)
    } finally {
      loading.value = false
    }
  }

  // 添加题目
  const addQuestion = async (question) => {
    loading.value = true
    error.value = null
    
    try {
      const newQuestion = await api.createQuestion(question)
      questions.value.push(transformQuestion(newQuestion))
      return newQuestion
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 删除题目
  const deleteQuestion = async (id) => {
    loading.value = true
    error.value = null
    
    try {
      await api.deleteQuestion(id)
      const index = questions.value.findIndex(q => q.id === id)
      if (index > -1) {
        questions.value.splice(index, 1)
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 创建试卷
  const createExam = async (exam) => {
    loading.value = true
    error.value = null
    
    try {
      const newExam = await api.createExam(exam)
      exams.value.push(newExam)
      return newExam
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 删除试卷
  const deleteExam = async (id) => {
    loading.value = true
    error.value = null
    
    try {
      await api.deleteExam(id)
      const index = exams.value.findIndex(e => e.id === id)
      if (index > -1) {
        exams.value.splice(index, 1)
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取随机题目（用于无限制模式）
  const getRandomQuestions = (excludeIds = [], count = 1) => {
    const availableQuestions = questions.value.filter(q => !excludeIds.includes(q.id))
    if (availableQuestions.length === 0) return []
    
    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }

  // 提交考试答案
  const submitExam = async (examId, answers, scoringMode = 'add') => {
    const exam = exams.value.find(e => e.id === examId)
    if (!exam) return null

    let totalScore = 0
    let correctCount = 0
    const results = []

    exam.questions.forEach((questionId, index) => {
      const question = questions.value.find(q => q.id === questionId)
      if (!question) return

      const userAnswer = answers[questionId]
      let isCorrect = false

      if (question.type === 'single') {
        isCorrect = userAnswer === question.correctAnswer
      } else if (question.type === 'multiple') {
        isCorrect = Array.isArray(userAnswer) && 
          userAnswer.length === question.correctAnswer.length &&
          userAnswer.every(ans => question.correctAnswer.includes(ans))
      }

      if (isCorrect) {
        correctCount++
        if (scoringMode === 'add') {
          totalScore += question.score
        }
      } else if (scoringMode === 'subtract') {
        totalScore -= question.score
      }

      results.push({
        questionId,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        score: isCorrect ? question.score : (scoringMode === 'subtract' ? -question.score : 0)
      })
    })

    // 减分制确保最低分为0
    if (scoringMode === 'subtract') {
      totalScore = Math.max(0, exam.totalScore + totalScore)
    }

    const record = {
      examId,
      answers,
      score: totalScore,
      totalScore: exam.totalScore || totalScore,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    }

    try {
      const savedRecord = await api.createExamRecord(record)
      examRecords.value.push(savedRecord)
      return savedRecord
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 无限制模式专用：提交单题答案
  const submitUnlimitedAnswer = (questionId, userAnswer, currentScore) => {
    const question = questions.value.find(q => q.id === questionId)
    if (!question) return { isCorrect: false, newScore: currentScore }

    let isCorrect = false
    if (question.type === 'single') {
      isCorrect = userAnswer === question.correctAnswer
    } else if (question.type === 'multiple') {
      isCorrect = Array.isArray(userAnswer) && 
        userAnswer.length === question.correctAnswer.length &&
        userAnswer.every(ans => question.correctAnswer.includes(ans))
    }

    // 无限制模式：答对不得分，答错扣分
    const newScore = isCorrect ? currentScore : Math.max(0, currentScore - question.score)
    
    return {
      isCorrect,
      newScore,
      scoreChange: isCorrect ? 0 : -question.score,
      question
    }
  }

  // 刷新数据
  const refreshData = async () => {
    await initializeData()
  }

  return {
    questions,
    exams,
    examRecords,
    loading,
    error,
    totalQuestions,
    totalExams,
    totalParticipants,
    initializeData,
    addQuestion,
    deleteQuestion,
    createExam,
    deleteExam,
    submitExam,
    getRandomQuestions,
    submitUnlimitedAnswer,
    refreshData
  }
})