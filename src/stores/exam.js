import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// localStorage 键名常量
const STORAGE_KEYS = {
  QUESTIONS: 'exam_questions',
  EXAMS: 'exam_exams',
  EXAM_RECORDS: 'exam_records'
}

// 默认题库数据
const DEFAULT_QUESTIONS = [
  {
    id: 1,
    type: 'single',
    question: '以下哪个是Vue.js的核心特性？',
    options: ['响应式数据绑定', '虚拟DOM', '组件化', '以上都是'],
    correctAnswer: 3,
    score: 10
  },
  {
    id: 2,
    type: 'single',
    question: 'JavaScript中哪个方法用于添加数组元素？',
    options: ['push()', 'add()', 'insert()', 'append()'],
    correctAnswer: 0,
    score: 10
  },
  {
    id: 3,
    type: 'multiple',
    question: '以下哪些是CSS预处理器？',
    options: ['Sass', 'Less', 'Stylus', 'PostCSS'],
    correctAnswer: [0, 1, 2],
    score: 15
  },
  {
    id: 4,
    type: 'single',
    question: 'HTML5新增的语义化标签包括？',
    options: ['<header>', '<nav>', '<section>', '以上都是'],
    correctAnswer: 3,
    score: 10
  }
]

// localStorage 工具函数
const storage = {
  get(key) {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error)
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error)
    }
  }
}

export const useExamStore = defineStore('exam', () => {
  // 从localStorage读取数据，如果没有则使用默认值
  const questions = ref(storage.get(STORAGE_KEYS.QUESTIONS) || DEFAULT_QUESTIONS)
  const exams = ref(storage.get(STORAGE_KEYS.EXAMS) || [])
  const examRecords = ref(storage.get(STORAGE_KEYS.EXAM_RECORDS) || [])

  // 监听数据变化，自动保存到localStorage
  watch(questions, (newQuestions) => {
    storage.set(STORAGE_KEYS.QUESTIONS, newQuestions)
  }, { deep: true })

  watch(exams, (newExams) => {
    storage.set(STORAGE_KEYS.EXAMS, newExams)
  }, { deep: true })

  watch(examRecords, (newRecords) => {
    storage.set(STORAGE_KEYS.EXAM_RECORDS, newRecords)
  }, { deep: true })

  // 计算属性
  const totalQuestions = computed(() => questions.value.length)
  const totalExams = computed(() => exams.value.length)
  const totalParticipants = computed(() => examRecords.value.length)

  // 添加题目
  const addQuestion = (question) => {
    const newQuestion = {
      ...question,
      id: Date.now()
    }
    questions.value.push(newQuestion)
  }

  // 删除题目
  const deleteQuestion = (id) => {
    const index = questions.value.findIndex(q => q.id === id)
    if (index > -1) {
      questions.value.splice(index, 1)
    }
  }

  // 创建试卷
  const createExam = (exam) => {
    const newExam = {
      ...exam,
      id: Date.now(),
      createdAt: new Date().toISOString()
    }
    exams.value.push(newExam)
    return newExam
  }

  // 删除试卷
  const deleteExam = (id) => {
    const index = exams.value.findIndex(e => e.id === id)
    if (index > -1) {
      exams.value.splice(index, 1)
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
  const submitExam = (examId, answers, scoringMode = 'add') => {
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
      id: Date.now(),
      examId,
      totalScore,
      correctCount,
      totalQuestions: exam.questions.length,
      results,
      submittedAt: new Date().toISOString(),
      scoringMode
    }

    examRecords.value.push(record)
    return record
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

  // 清除所有存储数据
  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEYS.QUESTIONS)
    localStorage.removeItem(STORAGE_KEYS.EXAMS)
    localStorage.removeItem(STORAGE_KEYS.EXAM_RECORDS)
    
    // 重置为默认数据
    questions.value = [...DEFAULT_QUESTIONS]
    exams.value = []
    examRecords.value = []
  }

  return {
    questions,
    exams,
    examRecords,
    totalQuestions,
    totalExams,
    totalParticipants,
    addQuestion,
    deleteQuestion,
    createExam,
    deleteExam,
    submitExam,
    getRandomQuestions,
    submitUnlimitedAnswer,
    clearStorage
  }
})